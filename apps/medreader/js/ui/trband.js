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

   ── `[8c-1]` 탭 모드 (spec 17-7-6 4-1) ─────────────────
   `openTap(o)` — 멈춘 상태의 줄 탭·선택 동작 줄 [문장 번역]. **유효 모드와 무관하게** 띠를 보이고(`data-tr-band="on"`)
   그 문장(들)의 번역을 그린다(상태 문구는 `bandView` 규칙 그대로 — `tapView`). 문장 아래 표시면 열린 동안
   `suspendInline(true)`(controls → `inlinetr.suspend` — `data-tr-inline` 을 뗀다). 머리 끝 단추 칸: [문단 전체] · (12 의 [☆] 자리) · [×].
   닫기 = [×] · 다른 줄 탭(새 내용) · [▶] · 쪽 넘김 · 리더 떠남 · 낭독의 다음 문장(`linechange` — 7-7 낭독 문장으로 돌아감,
   유효 모드 `off` 면 닫힌 채 숨음). 요청은 하지 않는다 — controls 가 `readalong.requestTap` 을 부르고 띠는 `onChange` 로 안다.

   ── `[11-4]` 설명 모드 (spec 17-2-1 4-7 · 11-D16) ─────────
   `openNote(o)` — 탭 모드를 **넓힌 것**(같은 `tap` 자리 — 그래서 8c-1·8c-1b·8c-1c 의 닫기 다섯·Esc 층·포커스 되돌림·
   `data-tr-inline` 떼기/붙이기가 그대로 선다). 머리 단추 칸에 꼬리표 "설명"(`.tr-kind`)·[▶ 다시 듣기]·[×]. 상태는 순수 `noteView`
   (준비 중 · 글(+ 고지 한 줄) · 실패 + [다시 시도] · 막힘 짧은 줄 · 대상 아님). 요청·소리는 하지 않는다 — `ui/ask.js` 가 파이프라인을
   부르고 `updateNote` 로 알린다. 말하는 동안 `noteRoll` 이 기존 경과 비율 스크롤(`startRoll` 장치 하나)을 설명 글 길이로 돌린다.
   [×]·Esc 로 닫으면 `onClose`(ask — 말하기 멈춤, 되돌림 없음).

   ── `[12-2]` [☆] 기억 카드 (spec 17-11 5 · 12-D5) ─────────
   머리 단추 칸의 [☆] 자리(`#trSlot`)에 단추 하나(`#trStar`, 48×48) — **세 모드 같은 단추**: 낭독(지금 문장 — 표 안내·인용이면 숨김,
   칸에 홀로) · 탭(탭한 문장들 — [문단 전체] 보기면 숨김) · 설명(설명이 ready 일 때 — 설명 사본도). 무엇을 가리키는지는 순수
   `starTarget`, 상태·저장은 controls 가 넘긴 `setRemember({stateFor, toggle})`(`ui/remember.js` — 호출 0). 카드가 있으면 `[★]`
   (`aria-pressed="true"`). 누르면 낭독은 멈추지 않고, 띠를 만진 것으로 보지 않는다(굴림 멈춤은 띠 본문만 — `touchHolds`).
   결과 한 줄은 상태 줄에 잠깐(`flash`).
   ============================================================ */

import * as settings from '../settings.js';
import { t, applyTranslations, getDir, onLangChange, formatNumber } from '../i18n/index.js';
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
 * `[다듬기 4 — 8c1R · 8c-2]` 분 한도 cooldown(파이프라인 `RATE_MINUTE` — 원격 상태 이름은 `cooldown`)의 띠 한 줄.
 * `wait` — 기다리는 중([다시 시도] 없음 — 곧 다시 걸린다) · `ready` — 기다림 끝([다시 시도]). 자동으로 다시 보내지 않는다.
 */
export const RATE_KEYS = Object.freeze({ wait: 'readalong.blocked.rateWait', ready: 'readalong.blocked.rateReady' });
/** 파이프라인 `RATE_MINUTE` 와 같은 값(화면은 파이프라인 상수를 import 하지 않고 이벤트의 `code` 로 본다). */
export const RATE_CODE = 'RATE_MINUTE';

/** 지금 분 한도 cooldown 이면 `{until}`(ms — 0 이면 이미 끝) — 원격 이벤트(`onRemote`)가 고친다. */
let rate = null;
let rateTimer = null;
const rateFns = new Set();

/**
 * 원격 상태 이벤트 → 분 한도 기록. 분 한도 cooldown 이면 `{until}`, 그 밖(다른 cooldown·ready·다른 막힘)이면 null. 순수에 가깝다(모듈 값만).
 * @param {{state?:string, code?:string, until?:number}} d
 */
export function noteRemoteRate(d) {
  const x = d || {};
  if (x.state === 'cooldown' && x.code === RATE_CODE) rate = { until: Number(x.until) || 0 };
  // 풀린 뒤(ready) — 지나간 문장 아래 남은 막힘 줄(사유 `cooldown`)이 "응답 없음"으로 바뀌지 않게 "기다림 끝"으로 둔다(다음 막힘이 오면 바뀐다)
  else if (x.state === 'ready' && rate) rate = { until: 0 };
  else rate = null;
  return rate;
}

/**
 * 분 한도의 지금 국면 — `null`(분 한도 아님) · `'wait'` · `'ready'`.
 * @param {number} [nowMs]
 */
export function rateView(nowMs) {
  if (!rate) return null;
  const n = Number.isFinite(nowMs) ? nowMs : Date.now();
  return rate.until > n ? 'wait' : 'ready';
}

/** 분 한도 국면이 바뀔 때(기다림 끝 · 풀림) — 문장 아래 표시(`inlinetr`)가 막힘 줄을 다시 그린다. 되돌림 함수. */
export function onRateChange(fn) {
  if (typeof fn !== 'function') return () => {};
  rateFns.add(fn);
  return () => rateFns.delete(fn);
}

function fireRate() {
  Array.from(rateFns).forEach((fn) => { try { fn(rateView()); } catch (e) { /* 구독자 오류 */ } });
}

/** `bandView` 등이 쓰는 분 한도 국면 — 문맥에 `rate` 가 있으면 그것(시험), 없으면 모듈 값. */
function rateOf(c) {
  return c && c.rate !== undefined ? c.rate : rateView();
}

/** 막힘 사유 → 띠 한 줄·[다시 시도]. `cooldown` 이 분 한도면 `RATE_KEYS`(기다리는 중엔 [다시 시도] 없음). */
function blockedNote(code, c) {
  if (code === 'cooldown') {
    const rv = rateOf(c);
    if (rv === 'wait' || rv === 'ready') return { noteKey: RATE_KEYS[rv], retry: rv === 'ready' };
  }
  return { noteKey: BLOCKED_KEYS[code] || GATE_KEYS[code], retry: RETRYABLE_REMOTE.indexOf(code) >= 0 };
}

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
    const n = blockedNote(blockedBy, c);      // `[다듬기 4]` cooldown 이 분 한도면 그 문구(`ctx.rate` — 없으면 모듈 값)
    return { state: 'blocked', text: '', noteKey: n.noteKey, retry: n.retry, code: blockedBy };
  }
  // pending · 아직 묻지 않았음(none — refill 이 곧 pending 으로 바꾼다) · 그 밖
  return { state: 'pending', text: '', noteKey: 'readalong.pending', retry: false, code: null };
}

/**
 * `[8d — spec 7-7-1 I5]` 상태 → 한 줄 문구 키·[다시 시도] 여부. 띠(`bandView`)와 문장 아래 블록(`ui/inlinetr.js`)이
 * **이 규칙 하나**를 쓴다(문구 고르기가 두 벌이 되지 않게). 순수 함수.
 * @returns {{state:string, noteKey:string|null, retry:boolean}}
 */
export function noteKeyFor(rec, ctx) {
  const v = bandView(rec, ctx);
  return { state: v.state, noteKey: v.noteKey, retry: v.retry };
}

/** `[8c-1]` 탭 문지기 사유(`readalong.tapGate`) → 띠 한 줄. no-key·consent 는 상태 바 배너도 **즉시**(`noticeBanner`). */
export const GATE_KEYS = Object.freeze({
  consent: 'readalong.consent',
  'unsupported-lang': 'readalong.unsupportedLang',
  'same-lang': 'readalong.sameLang',
  'no-key': 'readalong.blocked.noKey'
});

/** `[8c-1]` 탭 막힘 중 상태 바 배너를 바로 띄우는 사유(재생을 기다리는 `DEFER_UNTIL_PLAY` 와 달리 사용자가 번역을 불렀다). */
export const TAP_BANNER_NOW = Object.freeze(['no-key', 'consent']);

/**
 * `[8c-1b]` Esc 가 탭 띠를 닫는가 — 띠가 열려 있고, 다른 손이 이미 쓰지 않았고(`prevented`), 띠보다 위의 층(팝오버·시트·
 * `<dialog>`·8e `[≡]`)이 하나도 열려 있지 않을 때만. 가장 위의 것 하나만 닫힌다. 순수 함수.
 * `[8c-1c]` 띠가 **실제로 보일 때만**(`shown:false` — 리더 화면이 숨었다: 검색 화면 등) · Esc 대상이 **편집 칸**이면(`editing` —
 * `input`·`textarea`·`select`·`[contenteditable]`) 손대지 않는다: 기본 동작(검색어 지우기·쪽 번호 입력 그대로)이 이긴다(8c1bR-8 #2·#3).
 * @param {{tapOpen:boolean, prevented?:boolean, layers?:number, shown?:boolean, editing?:boolean}} o
 * @returns {boolean}
 */
export function escClosesTap(o) {
  const x = o || {};
  if (x.shown === false || x.editing === true) return false;
  return !!x.tapOpen && !x.prevented && !(Number(x.layers) > 0);
}

/** `[8c-1c]` Esc 대상이 편집 칸인가(띠 안 단추는 아니다). DOM 요소를 받는다. */
function isEditable(t) {
  if (!t || typeof t.closest !== 'function') return false;
  if (t.isContentEditable) return true;
  return !!t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}

/**
 * `[8c-1b]` 연결이 돌아왔을 때(원격 상태 offline → ready) 탭 문단을 **한 번** 다시 보낼까 — 띠 글이 "연결되면 번역이 나옵니다"
 * 인데 낭독 창의 자동 재전송(`kick`)은 탭 문단을 모른다(8c-1 Review 8c1R-9 #3). 막힘(offline) 문장이 있고 아직 다시 보내지
 * 않았을 때만. 사용자 [다시 시도](`retry`)가 아니다 — `retry` 표시 없이 같은 `requestTap` 을 부른다. 순수 함수.
 * @param {Array<{state:string, code?:string}>} recs  문단 문장마다 `readalong.get(src)`
 * @param {?string} prev  직전 원격 상태
 * @param {boolean} already  이 탭에서 이미 다시 보냈는가
 * @returns {boolean}
 */
export function tapResendOnline(recs, prev, already) {
  if (already || prev !== 'offline') return false;
  return (Array.isArray(recs) ? recs : []).some((r) => !!r && r.state === 'blocked' && r.code === 'offline');
}

/**
 * `[8c-1 — spec 17-7-6 4-1]` 탭 모드 띠 한 장. 문장 여럿(탭한 줄의 문장들 또는 [문단 전체])의 상태를 하나로 모은다.
 * 준비된 번역은 seg 순서로 이어 보이고, 아직인 문장이 있으면 가장 무거운 상태(실패 > 막힘 > 번역 중)의 한 줄을 함께. 순수 함수.
 * @param {Array<{state:string, text?:string, code?:string}>|null} recs  문장마다 `readalong.get(src)` (번역 대상 문장만)
 * @param {{gate?:{ok:boolean, reason:string|null}, remote?:string}} ctx
 * @returns {{state:string, text:string, noteKey:string|null, retry:boolean, code:string|null}}
 */
export function tapView(recs, ctx) {
  const c = ctx || {};
  if (c.gate && !c.gate.ok) {
    return { state: 'blocked', text: '', noteKey: GATE_KEYS[c.gate.reason] || 'tap.none', retry: false, code: c.gate.reason || null };
  }
  const list = Array.isArray(recs) ? recs : [];
  if (!list.length) return { state: 'none', text: '', noteKey: 'tap.none', retry: false, code: null };
  const rank = { pending: 1, blocked: 2, failed: 3 };
  const texts = [];
  let worst = null;
  for (const r of list) {
    const v = bandView(r, { hasSentence: true, remote: c.remote, rate: c.rate });
    if (v.state === 'ready') { if (v.text) texts.push(v.text); continue; }
    if (!worst || (rank[v.state] || 0) > (rank[worst.state] || 0)) worst = v;
  }
  if (!worst) return { state: 'ready', text: texts.join(' '), noteKey: null, retry: false, code: null };
  return { state: worst.state, text: texts.join(' '), noteKey: worst.noteKey, retry: worst.retry, code: worst.code };
}

/**
 * `[11-4 — spec 17-2-1 4-7]` 설명 모드 띠 한 장. `rec` = ask 가 넘긴 `{state, text?, code?, key?}`. 순수 함수.
 *   · `pending` → "설명 준비 중…" · `ready` → 글 + 고지 한 줄(`explain.disclaimer` — 11-D18) · `failed` → "설명을 받지 못했습니다" + [다시 시도]
 *   · `blocked` → 8c-1 과 같은 짧은 줄(원격 `BLOCKED_KEYS` · 문지기 `GATE_KEYS`), [다시 시도]는 원격 `RETRYABLE_REMOTE` 만
 *     (사유가 `NETWORK`·`ABORTED` 처럼 표에 없으면 원격 상태 `remote` 로 — 그래도 없으면 실패와 같게)
 *   · `none` → 대상 아님 한 줄(`key` — 기본 `explain.notExplainable`, 표 안내·인용)
 * @param {?{state:string, text?:string, code?:string, key?:string}} rec
 * @param {{remote?:string}} [ctx]
 * @returns {{state:string, text:string, noteKey:string|null, retry:boolean, code:string|null}}
 */
export function noteView(rec, ctx) {
  const r = rec || { state: 'pending' };
  const c = ctx || {};
  if (r.state === 'ready') return { state: 'ready', text: String(r.text == null ? '' : r.text), noteKey: 'explain.disclaimer', retry: false, code: null };
  if (r.state === 'none') return { state: 'none', text: '', noteKey: r.key || 'explain.notExplainable', retry: false, code: null };
  if (r.state === 'blocked') {
    const code = BLOCKED_KEYS[r.code] || GATE_KEYS[r.code] ? r.code : (BLOCKED_KEYS[c.remote] ? c.remote : null);
    if (code) {
      const n = blockedNote(code, c);         // `[다듬기 4]` 분 한도 문구
      return { state: 'blocked', text: '', noteKey: n.noteKey, retry: n.retry, code: code };
    }
    return { state: 'failed', text: '', noteKey: 'explain.failed', retry: true, code: r.code || null };
  }
  if (r.state === 'failed') return { state: 'failed', text: '', noteKey: 'explain.failed', retry: true, code: r.code || null };
  return { state: 'pending', text: '', noteKey: 'explain.pending', retry: false, code: null };
}

/**
 * `[11-4b — 11-4R #1]` 낭독 중 단추로 부른 설명이 실패해 곧 되돌렸을 때의 상태 바 배너 모양 — 띠 실패 줄은 재개와 함께 닫히므로.
 * `noteView` 가 "실패"(PARSE·MISSING·SAFETY·EMPTY·DIGITS·표에 없는 사유)일 때만 — 원격 막힘(429·상한·offline·키 없음 …)은
 * 이미 원격 상태 배너가 있어 null. [다시 시도] 단추는 `noteBanner` 가 붙인다(동작이 함수라 `actions`(이동만)에 담지 않는다). 순수 함수.
 * @returns {{key:string, params:null, actions:Array}|null}
 */
export function noteFailBanner(rec, ctx) {
  return noteView(rec, ctx).state === 'failed' ? { key: 'explain.failed', params: null, actions: [] } : null;
}

/**
 * `[12-2 — spec 17-11 5]` 띠 [☆] 가 지금 가리키는 문장(들) — 없으면 null(단추 숨김). 순수 함수.
 *   · 설명 모드(`note`) — 설명이 ready 이고 그 문장 단위(`unit`)를 알 때: `{origin:'explain', unit, explain}`
 *   · 탭 모드(`tap`) — [문단 전체] 보기가 아니고 탭한 문장이 있을 때: `{origin:'tap', segs}`(둘이면 카드 둘)
 *   · 낭독 모드 — 지금 문장이 있고 표 안내·인용이 아닐 때(`seg` 가 있음): `{origin:'band', segs:[{seg, src}]}`
 * `key` = 대상이 바뀌었는지 가르는 값(메모리에만 — 디버그에 싣지 않는다). `enabled` 거짓(기억 카드 배선 없음)이면 늘 null.
 * @param {{enabled:boolean, cur?:{src:?string, seg:?number}, tap?:{full:boolean, segs:Array}, note?:{id:number, state:string, unit?:Object, text?:string}}} o
 * @returns {?{origin:string, key:string, segs?:Array, unit?:Object, explain?:string}}
 */
export function starTarget(o) {
  const x = o || {};
  if (!x.enabled) return null;
  if (x.note) {
    const n = x.note;
    return n.state === 'ready' && n.unit ? { origin: 'explain', unit: n.unit, explain: String(n.text == null ? '' : n.text), key: 'explain\u0001' + n.id } : null;
  }
  if (x.tap) {
    const segs = Array.isArray(x.tap.segs) ? x.tap.segs.filter((s) => s && typeof s.src === 'string' && s.src) : [];
    if (x.tap.full || !segs.length) return null;
    return { origin: 'tap', segs: segs.map((s) => ({ seg: s.seg, src: s.src })), key: 'tap\u0001' + segs.map((s) => s.seg + '\u0002' + s.src).join('\u0003') };
  }
  const c = x.cur || {};
  if (typeof c.src !== 'string' || !c.src || !Number.isInteger(c.seg)) return null;
  return { origin: 'band', segs: [{ seg: c.seg, src: c.src }], key: 'band\u0001' + c.seg + '\u0002' + c.src };
}

/**
 * `[12-2]` 띠를 만진 것이 굴림 멈춤(7-7)인가 — 띠 **본문**을 만질 때만. [☆] 단추(`data-tr-action="remember"`) 안이면 아니다. 순수 함수.
 * @param {?{closest?:Function}} target  이벤트 대상(DOM 요소)
 */
export function touchHolds(target) {
  return !(target && typeof target.closest === 'function' && target.closest('[data-tr-action="remember"]'));
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
    // `[8c-2 — 17-7-6 4-7]` 상한 도달 배너에 [사용량 보기] 하나 더(`#/usage` — 오늘 쓴 것·종류별을 본다)
    case 'capped': return { key: 'ai.state.capped', params: { cap: String(x.cap == null ? '' : x.cap) },
      actions: [{ key: 'reader.readalong.settings', nav: SETTINGS_AI_HASH }, { key: 'usage.open', nav: '#/usage' }] };
    // `[다듬기 4]` 분 한도 — 기다리는 중(약 {s}초)·기다림 끝([다시 시도]). 다른 cooldown(응답 없음)은 그대로.
    case 'cooldown':
      if (x.rate === 'wait') return { key: 'ai.state.rateWait', params: { s: String(x.waitSec == null ? '' : x.waitSec) }, actions: [] };
      if (x.rate === 'ready') return { key: 'ai.state.rateReady', params: null, actions: [] };
      return { key: 'ai.state.cooldown', params: null, actions: [] };
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
 * `[8c-1]` 탭 모드 — 열려 있으면 `{lineId, segs, paraSegs, gate, full, retry, offs}`, 닫히면 null.
 * `segs`·`paraSegs` 는 `{seg, src}`(번역 대상 문장만 — controls 가 `readalong.translatable` 로 거름).
 */
let tap = null;
/** `[8c-1]` controls 가 넘긴 문장 아래 표시 멈춤(`inlinetr.suspend`). */
let suspendInline = null;
/**
 * `[11-4]` 설명 모드 번호 — `openNote` 마다 하나씩 오른다. `tap.note.id` 와 다르면 그 설명은 이미 닫혔거나 다른 것으로 바뀌었다
 * (`updateNote`·`noteRoll` 이 늦게 와도 다른 띠를 칠하지 않는다).
 */
let noteSeq = 0;

/** `[12-2]` 기억 카드 — controls 가 넘긴 `{stateFor(target), toggle(target), noteUnit(lineId)}`(`ui/remember.js`). 없으면 [☆] 없음. */
let rem = null;
/** `[12-2]` [☆] 상태 — 가리키는 대상(`starTarget`)·눌림·누르는 중·번호(늦게 온 답이 다른 문장을 칠하지 않게). */
const star = { key: null, target: null, pressed: false, busy: false, seq: 0 };
/** `[12-2]` 상태 줄에 잠깐 보일 한 줄(i18n 키) — `flash`. */
let flashKey = null;
let flashTimer = null;
const FLASH_MS = 2500;

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
    retry: band.querySelector('#trRetry'),
    // `[8c-1]` 탭 모드 머리 끝 단추 칸 — [문단 전체] · [☆] 자리(12) · [×]
    tools: band.querySelector('#trTools'),
    para: band.querySelector('#trPara'),
    close: band.querySelector('#trClose'),
    // `[11-4]` 설명 모드 — 꼬리표 "설명" · [▶ 다시 듣기]
    kind: band.querySelector('#trKind'),
    replay: band.querySelector('#trReplay'),
    // `[12-2]` [☆] 자리(`#trSlot`)와 그 안의 단추 · 글리프
    slot: band.querySelector('#trSlot'),
    star: band.querySelector('#trStar'),
    starGlyph: band.querySelector('#trStarGlyph')
  };
  ra = d.readalong;
  sp = d.speaker;

  /* ── 위임 리스너 하나 — [다시 시도] · `[8c-1]` [×] · [문단 전체] ───────── */
  band.addEventListener('click', (ev) => {
    const b = ev.target && ev.target.closest ? ev.target.closest('[data-tr-action]') : null;
    if (!b || !band.contains(b)) return;
    if (b.getAttribute('data-tr-action') === 'retry') onRetry(b);
    else if (b.getAttribute('data-tr-action') === 'close') closeTapByUser(ev.detail === 0);   // `[8c-1c]` 0 = 키보드로 누름
    else if (b.getAttribute('data-tr-action') === 'para') toggleFull();
    else if (b.getAttribute('data-tr-action') === 'replay') onReplay();   // `[11-4]` [▶ 다시 듣기]
    else if (b.getAttribute('data-tr-action') === 'remember') onStar();   // `[12-2]` [☆]/[★] — 낭독은 그대로
  });

  /* ── `[8c-1b]` Esc — 탭 띠가 **가장 위**일 때만 닫는다. 붙잡기 단계에서 먼저 본다: 팝오버(Aa·속도)·시트(음성 고지 카드)·
     `<dialog>`·8e `[≡]` 가 열려 있으면 그쪽 몫이라 손대지 않는다(그것들이 자기 Esc 로 닫힌 뒤 띠까지 닫히지 않게). ── */
  document.addEventListener('keydown', onEscKey, true);

  /* ── 띠를 만지면 그 문장 동안 자동 스크롤을 멈춘다(7-7) — `[12-2]` [☆] 단추 누름은 본문을 만진 것이 아니다(`touchHolds`) ── */
  const hold = (ev) => { if (touchHolds(ev && ev.target)) roll.held = true; };
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

  onLangChange(() => { if (els) { applyTranslations(els.band); lastPaint = ''; paint(); paintStar(); } });
  applyTranslations(band);
  attachDebugHook();
  return api();
}

function api() {
  return { sync: sync, leave: leave, openTap: openTap, closeTap: closeTap, isTapOpen: isTapOpen, bandTop: bandTop,
    setInlineSuspend: setInlineSuspend,
    // `[12-2]` [☆] 기억 카드 — 배선 · 다른 입구(선택 줄·음성)로 저장한 뒤 다시 보기
    setRemember: setRemember, refreshStar: refreshStar,
    // `[11-4]` 설명 모드
    openNote: openNote, updateNote: updateNote, noteRoll: noteRoll, isNoteOpen: isNoteOpen, noteView: noteView,
    noteBanner: noteBanner, dropNoteBanner: dropNoteBanner };   // `[11-4b]` · `[11-4c]`
}

/** `[8c-1]` 문장 아래 표시 멈춤 함수(controls → `inlinetr.suspend`). 탭 모드가 열리고 닫힐 때 부른다. */
export function setInlineSuspend(fn) { suspendInline = typeof fn === 'function' ? fn : null; }

/**
 * 유효 모드를 읽어 띠를 보이거나 숨기고 다시 그린다. controls 의 `syncReadalong()` 끝에서 불린다
 * (쪽이 그려질 때·재생 탭·모드 줄·단위 변경) — `mode` 이벤트가 없어도(값이 같아도) 리더에 다시 들어오면 자리를 잡는다.
 * `[8c-1]` 탭 모드가 열려 있으면 유효 모드와 무관하게 보인다.
 */
export function sync() {
  if (!els || !ra) return;
  const m = (ra.mode() || {}).mode || 'off';
  const on = m === 'show' || m === 'speak';
  const reader = els.band.closest('[data-screen="reader"]');
  const visible = (on || !!tap) && !(reader && reader.hidden);
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

/** 리더를 떠난다 — 자리를 비운다(다른 화면의 세로 예산을 건드리지 않는다). `[11-4c]` 설명 실패 배너도 거둔다. */
export function leave() {
  dropNoteBanner();
  if (!els) return;
  dropTap();
  stopRoll();
  if (offCur) { try { offCur(); } catch (e) { /* 이미 풀림 */ } offCur = null; }
  cur = { src: null, seg: null, page: null };
  lastPaint = '';
  clearFlash();                          // `[12-2]` [☆] 한 줄·상태도 거둔다(다른 문서에서 옛 답이 칠하지 않게)
  syncStar(null);
  els.band.hidden = true;
  document.documentElement.removeAttribute('data-tr-band');
}

/* ── 지금 문장 ─────────────────────────────────────────── */

function onLine(d) {
  // `[8c-1]` 낭독이 다음 문장으로 갔다 — 탭 모드를 닫고 낭독 문장으로 돌아간다(7-7). 유효 모드 off 면 `sync` 가 숨긴다.
  if (tap) closeTap();
  const src = typeof d.src === 'string' && d.src ? d.src : null;
  const seg = Number.isInteger(d.seg) ? d.seg : null;
  const same = src !== null && src === cur.src && seg === cur.seg;
  cur = { src: src, seg: seg, page: d.page == null ? null : d.page };
  if (!same) {
    if (offCur) { try { offCur(); } catch (e) { /* 이미 풀림 */ } offCur = null; }
    if (src !== null && seg !== null) offCur = ra.onChange(src, () => paint());
    // 새 문장 — 맨 위에서, 손을 뗀 상태로. show 모드는 원문 발화 시간으로 흐른다(7-7).
    roll.held = false;
    clearFlash();                        // `[12-2]` 앞 문장의 [☆] 한 줄을 다음 문장에 남기지 않는다
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
  } else if (roll.kind !== 'note') {
    disarmTimer();                       // `[11-4]` 설명을 말하는 동안(낭독은 멈춤)의 굴림은 낭독 상태와 무관하다
  }
}

function setSpeaking(ph) {
  if (els) els.band.setAttribute('data-speaking', ph === 'tr' ? 'tr' : 'src');
}

/* ── 그리기 ────────────────────────────────────────────── */

function targetLang() { return normalizeTranslationLang(settings.get('ai.translationLang')); }

function paint() {
  if (!els || !ra) return;
  if (tap) { paintTap(); return; }
  // `[12-2]` 낭독 모드의 머리 칸 = [☆] 홀로(문장일 때만) — [문단 전체]·꼬리표·[▶ 다시 듣기]·[×] 는 탭·설명 모드 것.
  const st = starTarget({ enabled: !!rem, cur: cur });
  if (els.tools) {
    els.tools.hidden = !st;
    if (els.para) els.para.hidden = true;
    if (els.kind) els.kind.hidden = true;
    if (els.replay) els.replay.hidden = true;
    if (els.close) els.close.hidden = true;
  }
  syncStar(st);
  els.band.removeAttribute('data-tap');
  const rec = cur.src ? ra.get(cur.src) : null;
  const v = bandView(rec, {
    hasSentence: cur.src !== null || cur.seg !== null || cur.page !== null,
    isNotice: cur.src === null || cur.seg === null,
    remote: safeRemote()
  });
  const a = translationBlockAttrs(targetLang());
  const sig = [v.state, v.text, v.noteKey, v.retry, a.lang, a.dir, flashKey].join('\u0001');
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

  // 상태 한 줄 — UI 언어·UI 방향. `[12-2]` [☆] 결과 한 줄이 떠 있으면 잠깐 그것(`flash`).
  els.note.dir = getDir();
  els.note.textContent = flashKey ? t(flashKey) : v.noteKey ? t(v.noteKey) : '';
  els.retry.hidden = !v.retry;
  els.retry.disabled = false;
  els.status.hidden = !flashKey && !v.noteKey && !v.retry;
  if (v.text && roll.kind) tick();          // 늦게 도착한 번역문도 지금 경과에 맞춘다
}

function safeRemote() {
  try { return ra.remoteState(); } catch (e) { return null; }
}

/* ── [다시 시도] (7-6 · 14-2) ──────────────────────────── */

function onRetry(btn) {
  if (!ra || btn.disabled) return;
  btn.disabled = true;                 // 두 번 눌러 두 번 보내지 않게 — 결과가 오면 다시 그린다
  // `[8c-1]` 탭 모드 — 그 문단을 `retry:true` 로 다시(controls 가 넘긴 `requestTap(para, {retry:true})`). 사용자 동작만.
  if (tap && typeof tap.retry === 'function') {
    Promise.resolve().then(tap.retry).catch(() => null).then(() => { lastPaint = ''; paint(); });
    return;
  }
  Promise.resolve()
    .then(() => ra.retry())
    .catch(() => null)
    .then(() => { lastPaint = ''; paint(); });
}

/* ── 경과 비율 스크롤 (7-7 · B7) ──────────────────────── */

function expectedFor(kind) {
  const rate = (sp && typeof sp.getRate === 'function') ? sp.getRate() : 1;
  // `[11-4]` 설명 글 — 대상 언어 음성(번역문과 같은 초당 글자), 소리에서 빠지는 괄호 원어는 빼고 센다.
  if (kind === 'note') return speechMs(tap && tap.note ? trSpeechText(tap.note.text) : '', TR_CHARS_PER_SEC, rate);
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
  if (!els || !roll.kind || roll.held || els.band.hidden || (tap && roll.kind !== 'note')) return;
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

/* ── `[8c-1]` 탭 모드 (spec 17-7-6 4-1) ───────────────── */

/**
 * 탭 번역 띠를 연다(이미 열려 있으면 새 내용으로 바꾼다). 요청은 하지 않는다 — controls 가 `requestTap` 을 부른다.
 * @param {{lineId?:string, segs:{seg:number, src:string}[], paraSegs?:{seg:number, src:string}[],
 *          gate?:{ok:boolean, reason:string|null}, retry?:Function}} o
 */
export function openTap(o) {
  if (!els || !ra) return;
  const x = o || {};
  const segs = Array.isArray(x.segs) ? x.segs.filter((s) => s && typeof s.src === 'string') : [];
  const para = Array.isArray(x.paraSegs) ? x.paraSegs.filter((s) => s && typeof s.src === 'string') : segs.slice();
  const was = !!tap;
  unwatchTap();
  tap = { lineId: x.lineId == null ? null : String(x.lineId), segs: segs, paraSegs: para.length ? para : segs.slice(),
    gate: x.gate && typeof x.gate.ok === 'boolean' ? { ok: x.gate.ok, reason: x.gate.reason || null } : { ok: true, reason: null },
    full: false, retry: typeof x.retry === 'function' ? x.retry : null, offs: [],
    // `[8c-1b]` 연결 회복 때 한 번 다시 보내기(retry 표시 없음) · [×]·Esc 로 닫은 뒤 포커스를 돌려놓을 곳(탭한 줄 — 없으면 리더 본문)
    resend: typeof x.resend === 'function' ? x.resend : null, resent: false,
    focusBack: typeof x.focusBack === 'function' ? x.focusBack : null };
  // 문단의 모든 문장을 지켜본다([문단 전체]로 바꿔도 같은 구독).
  const seen = new Set();
  for (const s of tap.paraSegs.concat(tap.segs)) {
    if (seen.has(s.src)) continue;
    seen.add(s.src);
    tap.offs.push(ra.onChange(s.src, () => { if (tap) paint(); }));
  }
  stopRoll();
  els.band.removeAttribute('data-saying');   // `[11-4]` 설명을 말하던 띠를 번역 탭으로 바꿨다
  if (!was && suspendInline) { try { suspendInline(true); } catch (e) { /* 띠는 그래도 연다 */ } }
  // 막힘 안내 — 키 없음·동의는 상태 바도 **즉시**(사용자가 번역을 불렀다). 재생을 기다리던 같은 안내는 거둔다(두 번 뜨지 않게).
  const reason = tap.gate.ok ? null : tap.gate.reason;
  if (reason && TAP_BANNER_NOW.indexOf(reason) >= 0) {
    const b = noticeBanner(reason, null);
    if (b) { banners.deferred.delete(reason); banners.notice.set(reason, b.key); banner(b); }
  }
  lastPaint = '';
  resetScroll();
  sync();
}

/** 탭 모드를 닫는다 — 낭독 문장(또는 유효 모드 `off` 면 숨김)으로 돌아간다. 열려 있지 않으면 아무 일도 없다. */
export function closeTap() {
  if (!tap) return;
  dropTap();
  lastPaint = '';
  resetScroll();
  sync();
}

/**
 * `[8c-1b]` 사용자가 닫았다([×]·Esc) — 닫고 포커스를 탭한 줄(없으면 리더 본문)로 되돌린다. 숨은 [×] 에서 포커스가 `body` 로
 * 떨어지지 않게(8c-1 Review 8c1R-5). 다른 닫기(다른 줄 탭·[▶]·쪽 넘김·낭독 다음 문장)는 포커스를 건드리지 않는다.
 * `[8c-1c]` `byKey` — 키보드로 닫았다(Esc · [×] 를 Enter/Space 로 — `click.detail === 0`). 그때만 그 줄이 화면 밖이면 굴려 보인다
 * (8c1bR-8 #5 — 포커스 표시가 보이게). 손가락·마우스로 [×] 를 누른 사람은 읽던 자리를 굴려 둔 것이라 끌어올리지 않는다.
 */
function closeTapByUser(byKey) {
  if (!tap) return;
  const back = tap.focusBack;
  const onClose = tap.note && typeof tap.note.onClose === 'function' ? tap.note.onClose : null;
  closeTap();
  // `[11-4]` 설명 모드를 손으로 닫았다 — 말하고 있으면 멈춘다(ask — 되돌림 없음, 손이 이긴다).
  if (onClose) { try { onClose(); } catch (e) { /* 띠는 닫혔다 */ } }
  if (back) { try { back(!!byKey); } catch (e) { /* 포커스를 못 옮겨도 띠는 닫혔다 */ } }
}

/** 띠보다 위의 층 — 보이는 팝오버·시트(`role=dialog`)·열린 `<dialog>`·펼친 8e `[≡]`. */
function upperLayers() {
  let n = 0;
  for (const el of document.querySelectorAll('dialog[open], [role="dialog"]:not([hidden])')) {
    if (el.getClientRects().length) n++;
  }
  const chrome = document.getElementById('chromeToggle');
  if (chrome && chrome.getAttribute('aria-expanded') === 'true' && chrome.getClientRects().length) n++;
  return n;
}

function onEscKey(ev) {
  if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
  if (!els || !tap || els.band.hidden) return;
  if (!escClosesTap({ tapOpen: true, prevented: ev.defaultPrevented, layers: upperLayers(), shown: bandShown(), editing: isEditable(ev.target) })) return;
  ev.preventDefault();
  closeTapByUser(true);
}

/** `[8c-1c]` 띠가 정말 보이는가 — 띠 자신의 `hidden` 만이 아니라 리더 화면 섹션의 숨김(검색 화면 뒤 숨은 리더)·그려진 상자까지. */
function bandShown() {
  if (!els || els.band.hidden) return false;
  const reader = els.band.closest('[data-screen="reader"]');
  if (reader && reader.hidden) return false;
  return els.band.getClientRects().length > 0;
}

/** 탭 상태·구독만 거둔다(그리기 없음) — `leave` 와 `closeTap` 이 같이 쓴다. */
function dropTap() {
  if (!tap) return;
  unwatchTap();
  tap = null;
  if (roll.kind === 'note') stopRoll();  // `[11-4]` 설명 글 굴림도 거둔다
  if (els) {
    els.band.removeAttribute('data-tap');
    els.band.removeAttribute('data-note');
    els.band.removeAttribute('data-saying');
    if (els.tools) els.tools.hidden = true;
  }
  if (suspendInline) { try { suspendInline(false); } catch (e) { /* 되돌림 실패가 띠를 막지 않는다 */ } }
}

function unwatchTap() {
  if (!tap) return;
  for (const off of tap.offs) { try { off(); } catch (e) { /* 이미 풀림 */ } }
  tap.offs = [];
}

export function isTapOpen() { return !!tap; }

/** 띠 윗변(px, 뷰포트 기준) — 보이지 않으면 null. 탭한 줄 가림 굴리기(4-1)가 쓴다. */
export function bandTop() {
  if (!els || els.band.hidden) return null;
  const r = els.band.getBoundingClientRect();
  return r && r.height > 0 ? r.top : null;
}

/** [문단 전체] — 탭한 문장(들) ↔ 그 문단 모든 문장. 띠 안 스크롤로 본다. */
function toggleFull() {
  if (!tap) return;
  tap.full = !tap.full;
  lastPaint = '';
  resetScroll();
  paint();
}

function paintTap() {
  if (tap.note) { paintNote(); return; }
  if (els.kind) els.kind.hidden = true;            // `[11-4]` 번역 탭에는 설명 꼬리표·[▶ 다시 듣기]가 없다
  if (els.replay) els.replay.hidden = true;
  if (els.close) { els.close.setAttribute('aria-label', t('tap.close')); els.close.hidden = false; }
  els.band.removeAttribute('data-note');
  // `[12-2]` [☆] — 탭한 문장(들). [문단 전체] 보기에서는 숨김.
  syncStar(starTarget({ enabled: !!rem, tap: tap }));
  const list = tap.full ? tap.paraSegs : tap.segs;
  const v = tapView(tap.gate.ok ? list.map((s) => ra.get(s.src)) : null, { gate: tap.gate, remote: safeRemote() });
  const a = translationBlockAttrs(targetLang());
  const showPara = tap.gate.ok && tap.paraSegs.length > tap.segs.length;
  const sig = ['tap', tap.full, showPara, v.state, v.text, v.noteKey, v.retry, a.lang, a.dir, flashKey].join('\u0001');
  els.band.setAttribute('data-state', v.state);
  els.band.setAttribute('data-tap', 'on');
  if (sig === lastPaint) return;
  lastPaint = sig;

  if (els.tools) els.tools.hidden = false;
  if (els.para) {
    els.para.hidden = !showPara;
    els.para.setAttribute('aria-pressed', tap.full ? 'true' : 'false');
  }
  const tx = els.text;
  while (tx.firstChild) tx.removeChild(tx.firstChild);
  tx.lang = a.lang;
  tx.dir = a.dir;
  if (v.text) appendBidiText(tx, v.text, a.dir);
  tx.hidden = !v.text;
  els.note.dir = getDir();
  els.note.textContent = flashKey ? t(flashKey) : v.noteKey ? t(v.noteKey) : '';
  els.retry.hidden = !v.retry;
  els.retry.disabled = false;
  els.status.hidden = !flashKey && !v.noteKey && !v.retry;
}

/* ── `[11-4 — spec 17-2-1 4-7 · 11-D16]` 설명 모드 — 탭 모드 자리(`tap`)를 넓힌 것 ── */

/**
 * 설명 띠를 연다(번역 탭·다른 설명이 열려 있으면 바꾼다). 요청·소리는 하지 않는다(`ui/ask.js`). 돌려준 번호로 `updateNote`·`noteRoll`.
 * @param {{lineId?:string, rec?:{state:string, text?:string, code?:string, key?:string}, gate?:{ok:boolean, reason:?string},
 *          retry?:Function, replay?:Function, onClose?:Function, focusBack?:Function}} o
 *   `rec` 첫 상태(기본 pending) · `gate` 문지기가 막았으면 no-key·consent 는 상태 바 배너도 **즉시**(탭 모드와 같은 규칙)
 *   · `retry` [다시 시도] · `replay` [▶ 다시 듣기] · `onClose` [×]·Esc 로 닫힘 · `focusBack(byKey)` 닫은 뒤 포커스
 * @returns {number} 설명 번호(띠가 없으면 0)
 */
export function openNote(o) {
  if (!els || !ra) return 0;
  const x = o || {};
  const was = !!tap;
  unwatchTap();
  if (roll.kind === 'note') stopRoll();
  els.band.removeAttribute('data-saying');
  noteSeq++;
  tap = { lineId: x.lineId == null ? null : String(x.lineId), segs: [], paraSegs: [], gate: { ok: true, reason: null },
    full: false, retry: typeof x.retry === 'function' ? x.retry : null, offs: [], resend: null, resent: false,
    focusBack: typeof x.focusBack === 'function' ? x.focusBack : null,
    note: { id: noteSeq, kind: 'explain', rec: x.rec || { state: 'pending' }, text: '',
      replay: typeof x.replay === 'function' ? x.replay : null, onClose: typeof x.onClose === 'function' ? x.onClose : null,
      // `[12-2]` [☆] 가 카드로 만들 문장 단위 — 여는 이 순간 controls 가 고른다(`noteUnit` — 설명 흐름과 같은 대상)
      unit: noteUnitOf(x.lineId) } };
  tap.note.text = tap.note.rec.state === 'ready' ? String(tap.note.rec.text || '') : '';
  stopRoll();
  if (!was && suspendInline) { try { suspendInline(true); } catch (e) { /* 띠는 그래도 연다 */ } }
  const reason = x.gate && x.gate.ok === false ? x.gate.reason : null;
  if (reason && TAP_BANNER_NOW.indexOf(reason) >= 0) {
    const b = noticeBanner(reason, null);
    if (b) { banners.deferred.delete(reason); banners.notice.set(reason, b.key); banner(b); }
  }
  lastPaint = '';
  resetScroll();
  sync();
  return noteSeq;
}

/** 열린 설명(번호 `id`)의 상태를 바꾼다. 이미 닫혔거나 다른 띠면 아무 일도 없이 false. */
export function updateNote(id, rec) {
  if (!tap || !tap.note || tap.note.id !== id) return false;
  tap.note.rec = rec || { state: 'pending' };
  tap.note.text = tap.note.rec.state === 'ready' ? String(tap.note.rec.text || '') : '';
  lastPaint = '';
  resetScroll();
  paint();
  return true;
}

/** 설명을 말하는 동안 띠 안을 발화 경과 비율로 굴린다(`on`) / 멈춘다. 기존 굴림 장치(`roll`·`tick`) 그대로 — 낭독 상태와 무관. */
export function noteRoll(id, on) {
  if (!tap || !tap.note || tap.note.id !== id) return;
  if (!on) { if (roll.kind === 'note') stopRoll(); els.band.removeAttribute('data-saying'); return; }
  els.band.setAttribute('data-saying', 'on');
  roll.kind = 'note';
  roll.held = false;
  roll.origin = Date.now();
  roll.expected = expectedFor('note');
  resetScroll();
  armTimer();
}

/** 설명 띠가 열려 있는가(`id` 를 주면 그 설명인가). */
export function isNoteOpen(id) {
  return !!tap && !!tap.note && (id == null || tap.note.id === id);
}

/** [▶ 다시 듣기] — ask 가 넘긴 함수(낭독 중이면 멈추고 말한 뒤 이어 읽기 — `ask.listen` 과 같은 규칙). */
function onReplay() {
  if (!tap || !tap.note || typeof tap.note.replay !== 'function' || tap.note.rec.state !== 'ready') return;
  try { tap.note.replay(); } catch (e) { /* 소리를 못 내도 띠는 그대로 */ }
}

function paintNote() {
  const n = tap.note;
  const v = noteView(n.rec, { remote: safeRemote() });
  const a = translationBlockAttrs(targetLang());
  // `[12-2]` [☆] — 설명이 ready 일 때(그 문장 + 설명 사본 + 있으면 번역).
  syncStar(starTarget({ enabled: !!rem, note: { id: n.id, state: v.state, unit: n.unit, text: n.text } }));
  const sig = ['note', n.id, v.state, v.text, v.noteKey, v.retry, a.lang, a.dir, flashKey].join('\u0001');
  els.band.setAttribute('data-state', v.state);
  els.band.setAttribute('data-tap', 'on');
  els.band.setAttribute('data-note', n.kind);
  if (sig === lastPaint) return;
  lastPaint = sig;

  if (els.tools) els.tools.hidden = false;
  if (els.para) els.para.hidden = true;                 // 설명에는 [문단 전체]가 없다
  if (els.kind) els.kind.hidden = false;
  if (els.close) { els.close.setAttribute('aria-label', t('explain.close')); els.close.hidden = false; }
  if (els.replay) els.replay.hidden = !(v.state === 'ready' && n.replay);
  // 설명 글 — 대상 언어(`ai.translationLang`)의 dir·lang, 라틴 괄호는 `appendBidiText`(번역문과 같은 함수 — 13절 textContent).
  const tx = els.text;
  while (tx.firstChild) tx.removeChild(tx.firstChild);
  tx.lang = a.lang;
  tx.dir = a.dir;
  if (v.text) appendBidiText(tx, v.text, a.dir);
  tx.hidden = !v.text;
  els.note.dir = getDir();
  els.note.textContent = flashKey ? t(flashKey) : v.noteKey ? t(v.noteKey) : '';
  els.retry.hidden = !v.retry;
  els.retry.disabled = false;
  els.status.hidden = !flashKey && !v.noteKey && !v.retry;
}

/* ── `[12-2 — spec 17-11 5 · 12-D5]` [☆] 기억 카드 — 세 모드 같은 단추 ───── */

/**
 * controls 가 넘긴 기억 카드 배선 — `{stateFor(target), toggle(target), noteUnit(lineId)}`(`ui/remember.js` + controls 의 설명 대상 고르기).
 * 없으면(null) [☆] 를 보이지 않는다.
 */
export function setRemember(r) {
  rem = r && typeof r.stateFor === 'function' && typeof r.toggle === 'function' ? r : null;
  refreshStar();
}

/** 설명 띠를 여는 순간 그 문장 단위를 묻는다(없으면 null — 그 설명에는 [☆] 가 없다). */
function noteUnitOf(lineId) {
  if (!rem || typeof rem.noteUnit !== 'function') return null;
  try { return rem.noteUnit(lineId == null ? null : String(lineId)) || null; } catch (e) { return null; }
}

/** 지금 띠가 가리키는 [☆] 대상(모드별 — `starTarget`). */
function currentStar() {
  if (!tap) return starTarget({ enabled: !!rem, cur: cur });
  if (tap.note) {
    const v = noteView(tap.note.rec, { remote: safeRemote() });
    return starTarget({ enabled: !!rem, note: { id: tap.note.id, state: v.state, unit: tap.note.unit, text: tap.note.text } });
  }
  return starTarget({ enabled: !!rem, tap: tap });
}

/** 다른 입구(선택 줄·음성)로 저장했다 — 같은 문장이면 [★] 로 다시 본다. */
export function refreshStar() {
  if (!els) return;
  star.key = null;
  syncStar(els.band.hidden ? null : currentStar());
}

/**
 * 대상이 바뀌었을 때만 카드 유무를 한 번 묻는다(문장이 바뀔 때 — id 는 해시 하나 + `get` 한 번). 자리(`#trSlot`)는 대상이 있을 때만.
 * 답이 늦게 와도 그 사이 대상이 바뀌었으면(번호) 칠하지 않는다.
 */
function syncStar(target) {
  if (!els || !els.slot) return;
  els.slot.hidden = !target;
  const key = target ? target.key : null;
  if (key === star.key) return;
  star.key = key;
  star.target = target || null;
  star.pressed = false;
  star.busy = false;
  star.seq++;
  paintStar();
  if (!target || !rem) return;
  const my = star.seq;
  Promise.resolve()
    .then(() => rem.stateFor(target))
    .then((r) => { if (my !== star.seq) return; star.pressed = !!(r && r.pressed); paintStar(); }, () => null);
}

/** `[☆]`/`[★]` — 눌림(`aria-pressed`)·이름("기억 카드에 넣기"/"기억 카드에 있음")·글리프. */
function paintStar() {
  if (!els || !els.star) return;
  const k = star.pressed ? 'remember.added' : 'remember.add';
  els.star.setAttribute('aria-pressed', star.pressed ? 'true' : 'false');
  els.star.setAttribute('data-i18n-aria', k);
  els.star.setAttribute('aria-label', t(k));
  if (els.starGlyph) els.starGlyph.textContent = star.pressed ? '★' : '☆';
  if (star.busy) els.star.setAttribute('aria-busy', 'true'); else els.star.removeAttribute('aria-busy');
}

/** [☆] 누름 — 저장(☆) 또는 복습 전 카드 지움(★). 낭독·띠 굴림은 건드리지 않는다. 누르는 중 다시 누르면 무시. */
function onStar() {
  if (!rem || !star.target || star.busy) return;
  const target = star.target;
  const my = star.seq;
  star.busy = true;
  paintStar();
  Promise.resolve()
    .then(() => rem.toggle(target))
    .then((r) => {
      if (my !== star.seq) return;
      star.busy = false;
      star.pressed = !!(r && r.pressed);
      paintStar();
      if (r && r.key) flash(r.key);
    }, () => {
      if (my !== star.seq) return;
      star.busy = false;
      paintStar();
      flash('remember.failed');
    });
}

/** 상태 줄에 한 줄을 잠깐(`FLASH_MS`) — [☆] 결과("기억 카드에 넣었습니다"·"복습 중인 카드입니다 …"). */
function flash(key) {
  if (!els) return;
  clearFlash();
  flashKey = key || null;
  if (flashKey && typeof window !== 'undefined') {
    flashTimer = window.setTimeout(() => { flashTimer = null; flashKey = null; lastPaint = ''; paint(); }, FLASH_MS);
  }
  lastPaint = '';
  paint();
}

function clearFlash() {
  if (flashTimer !== null && typeof window !== 'undefined') window.clearTimeout(flashTimer);
  flashTimer = null;
  flashKey = null;
}

/* ── 상태 바 (14절 배너) — 바뀔 때 한 번 ──────────────── */

function banner(b) {
  if (!b || !b.key) return;
  document.dispatchEvent(new CustomEvent('medreader:banner', {
    detail: { key: b.key, tone: 'warn', params: b.params || null, actions: b.actions || [] }
  }));
}

/** `[11-4b]` 설명 실패 배너의 [다시 시도]가 부를 함수 — 마지막 실패의 것(같은 키 배너는 한 장이라 단추도 하나). */
let noteRetryFn = null;

/**
 * `[11-4b — 11-4R #1]` 낭독 중 단추 설명이 실패해 곧 되돌렸다 — 상태 바에 `explain.failed` 한 줄 + [다시 시도](`retry` — ask 가 넘긴,
 * 그 문장을 `retry:true` 로 다시 부르는 함수). 원격 막힘이면(`noteFailBanner` null) 아무것도 하지 않고 false.
 * 배너 상자(`#banners`)는 `role=status`·`aria-live=polite` 라 화면 읽기에도 알려진다(11-4R #5). 단추는 `main.js` 가 만든 배너에
 * 붙인다 — 글은 `readalong.retry`(띠 [다시 시도]와 같은 문구 · `data-i18n` 이라 언어가 바뀌면 `relabelBanners` 가 다시 쓴다).
 * 누르면 배너를 거두고(`withdraw`) 한 번 부른다.
 * @returns {boolean} 띄웠는가
 */
export function noteBanner(rec, retry) {
  const b = noteFailBanner(rec, { remote: safeRemote() });
  if (!b || typeof document === 'undefined') return false;
  noteRetryFn = typeof retry === 'function' ? retry : null;
  banner(b);
  const bar = document.querySelector('#banners .banner[data-key="' + b.key + '"]');
  if (bar && noteRetryFn && !bar.querySelector('button[data-note-retry]')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'banner-action';
    btn.setAttribute('data-note-retry', '1');
    btn.setAttribute('data-i18n', 'readalong.retry');
    btn.textContent = t('readalong.retry');
    btn.addEventListener('click', () => {
      const fn = noteRetryFn;
      noteRetryFn = null;
      withdraw(b.key);
      if (fn) { try { Promise.resolve(fn()).catch(() => null); } catch (e) { /* 결과는 띠가 그린다 */ } }
    });
    bar.insertBefore(btn, bar.querySelector('button.banner-close'));
  }
  return true;
}

/**
 * `[11-4c — 11-4bR #1]` 설명 실패 배너와 그 [다시 시도]를 거둔다 — 리더를 떠날 때(`leave`)·쪽이 바뀔 때(controls `onPageRender`).
 * 옛 문장을 다른 화면·쪽·문서에서 다시 부르지 않게(8c-1 "다른 쪽 문장의 번역이 남지 않게"와 같은 결). 떠 있지 않으면 아무 일도 없다.
 */
export function dropNoteBanner() {
  noteRetryFn = null;
  withdraw('explain.failed');
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
  // `[다듬기 4]` 분 한도 기록 — 기다림이 끝나는 때에 띠·상태 바·문장 아래 줄을 "[다시 시도]" 로 바꾼다(보내지는 않는다 — 자동 재시도 0)
  const was = rateView();
  noteRemoteRate(d);
  armRateTimer();
  if (was !== rateView()) fireRate();
  if (state === 'ready') {
    banners.remote = null;
    if (prevKey) withdraw(prevKey);
    lastPaint = ''; paint();
    resendTapOnline(d.prev);
    return;
  }
  showRemoteBanner(state);
}

/** 원격 상태 배너를 띄운다(같은 키면 `banner` 가 알아서 하나만). 분 한도면 국면·남은 초를 함께. */
function showRemoteBanner(state) {
  const prevKey = banners.remote;
  const rv = state === 'cooldown' ? rateView() : null;
  const waitSec = rv === 'wait' ? formatNumber(Math.max(1, Math.ceil((rate.until - Date.now()) / 1000))) : null;
  const b = remoteBanner(state, { providerLabel: providerLabel(), cap: settings.get('ai.dailyCap'), rate: rv, waitSec: waitSec });
  if (!b) return;
  if (prevKey && prevKey !== b.key) withdraw(prevKey);
  banners.remote = b.key;
  banner(b);
  lastPaint = ''; paint();
}

/** `[다듬기 4]` 분 한도 기다림이 끝나는 때 — 띠를 다시 그리고 배너를 "기다림 끝"으로 바꾸고 구독자(문장 아래)에 알린다. 요청은 보내지 않는다. */
function armRateTimer() {
  if (rateTimer) { clearTimeout(rateTimer); rateTimer = null; }
  if (!rate || !(rate.until > Date.now())) return;
  rateTimer = setTimeout(() => {
    rateTimer = null;
    if (!rate) return;
    if (safeRemote() === 'cooldown') showRemoteBanner('cooldown');
    else { lastPaint = ''; paint(); }
    fireRate();
  }, rate.until - Date.now() + 50);
}

/** `[8c-1b]` 연결 회복 — 탭 띠가 offline 막힘이면 그 문단을 한 번 다시 보낸다(`tapResendOnline`). 결과는 `onChange` 로 그려진다. */
function resendTapOnline(prev) {
  if (!tap || typeof tap.resend !== 'function') return;
  if (!tapResendOnline(tap.paraSegs.map((s) => ra.get(s.src)), prev, tap.resent)) return;
  tap.resent = true;
  Promise.resolve().then(tap.resend).catch(() => null);
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
        scrollTop: els.band.scrollTop, scrollMax: els.band.scrollHeight - els.band.clientHeight,
        // `[8c-1]` 탭 모드 — 문장 수·문단 전체·문지기 사유만(글자 없음)
        tap: tap ? { segs: tap.segs.length, para: tap.paraSegs.length, full: tap.full, gate: tap.gate.reason } : null,
        // `[11-4]` 설명 모드 — 번호·상태·글자 수·사유만(글 없음)
        note: tap && tap.note ? { id: tap.note.id, state: tap.note.rec.state, code: tap.note.rec.code || null,
          chars: tap.note.text.length, replay: !!(els.replay && !els.replay.hidden), kind: !!(els.kind && !els.kind.hidden) } : null,
        // `[12-2]` [☆] — 보이는가·눌림·누르는 중·대상 종류·문장 수·한 줄 키만(글 없음)
        star: els.slot ? { shown: !!(els.tools && !els.tools.hidden && !els.slot.hidden), pressed: star.pressed, busy: star.busy,
          origin: star.target ? star.target.origin : null, n: star.target ? (star.target.segs ? star.target.segs.length : 1) : 0,
          wired: !!rem, flash: flashKey } : null
      };
    }
  };
}
